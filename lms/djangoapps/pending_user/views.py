import logging

from django.utils.decorators import method_decorator
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from edxmako.shortcuts import render_to_response
from openedx.core.djangoapps.user_api.accounts.api import check_account_exists
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from student.cookies import set_logged_in_cookies
from student.views import create_account_with_params
from third_party_auth.decorators import xframe_allow_whitelisted
from util.json_request import JsonResponse

from lms.djangoapps.pending_user.models import PendingUser, clean_phone
from .utils import JwtManager, validate_password

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

            AUDIT_LOG.info(
                "OTP validation successful for phone number: %s" % cleaned_phone
            )

            payload = {"phone": cleaned_phone}
            # FX TODO: change secret key
            jwt_manager = JwtManager('thisismysecretkey')
            jwt_token = jwt_manager.encode(payload)

            return Response(
                {"success": True, "jwt": jwt_token}, 
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {"error": True, "error_description": "OTP is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CreatePasswordAPI(APIView):
    """
    Create password for a pending user
    """

    def post(self, request, *args, **kwargs):
        password = request.data.get("password")
        jwt_token = request.data.get("jwt")

        if not validate_password(password):
            return Response(
                {"error": True, "error_description": "Invalid password"},
                status=status.HTTP_400_BAD_REQUEST,
        )

        # FX TODO: change secret key
        jwt_manager = JwtManager('thisismysecretkey')
        payload = jwt_manager.decode(jwt_token)
        phone_number = payload.get("phone")
        cleaned_phone = clean_phone(phone_number)
        if not cleaned_phone:
            return Response(
                {"error": True, "error_description": "Invalid JWT"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        pending_user = PendingUser.objects.filter(phone=cleaned_phone).first()
        if pending_user is None:
            return Response(
                {"error": True, "error_description": "User does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        username = cleaned_phone
        email = cleaned_phone + "@funix.edu.vn"
        conflicts = check_account_exists(username, email)
        if conflicts:
            return Response(
                {"error": True, "error_description": "User already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        data = {
            "username": username,
            "name": cleaned_phone,
            "country": "VN",
            "email": email,
            "password": password,
            "honor_code": 'True',
            "terms_of_service": 'True',
        }
        try:
            new_user = create_account_with_params(request, data)
        except Exception as e:
            return Response(
                {"error": True, "error_description": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        AUDIT_LOG.info("New user created: %s", new_user.username)
        response = JsonResponse({"success": True}, status=status.HTTP_200_OK)
        set_logged_in_cookies(request, response, new_user)
        return response


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def create_password(request):
    return render_to_response('pending_user/create_password.html', {})