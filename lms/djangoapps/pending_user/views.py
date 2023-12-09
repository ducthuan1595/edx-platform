import logging

from django.utils.decorators import method_decorator
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from edxmako.shortcuts import render_to_response
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from third_party_auth.decorators import xframe_allow_whitelisted

from lms.djangoapps.pending_user.models import PendingUser, clean_phone

AUDIT_LOG = logging.getLogger("audit")


class ValidateOTP(APIView):
    """
    Validate OTP for a pending user
    """
    # @method_decorator(csrf_exempt)
    def post(self, request, *args, **kwargs):
        base64_phone = request.data.get("phone")
        phone_number = urlsafe_base64_decode(base64_phone)
        cleaned_phone = clean_phone(phone_number)
        if not cleaned_phone:
            return Response(
                {"error": True, "error_description": "Invalid phone number"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        otp = request.data.get("otp")

        # FX TODO: change to find pending user by phone number and otp
        pending_user = PendingUser.objects.filter(phone=cleaned_phone).first()
        if pending_user is None:
            return Response(
                {"error": True, "error_description": "User does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pending_user.verification_code == otp and pending_user.is_valid():
            pending_user.verification_code = None
            pending_user.save()

            # FX TODO: redirect to input password page
            AUDIT_LOG.info(
                "OTP validation successful for phone number: %s" % cleaned_phone
            )
            return Response({"success": True}, status=status.HTTP_200_OK)
        else:
            return Response(
                {"error": True, "error_description": "OTP is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def create_password(request):
    return render_to_response('pending_user/create_password.html', {})