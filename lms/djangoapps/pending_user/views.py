import logging
import requests
import time

from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.views.decorators.http import require_http_methods

from edxmako.shortcuts import render_to_response
from openedx.core.djangoapps.user_api.accounts.api import check_account_exists
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from student.cookies import set_logged_in_cookies
from student.helpers import get_next_url_for_login_page
from student.views import create_account_with_params
from third_party_auth.decorators import xframe_allow_whitelisted
from util.json_request import JsonResponse
from util.bad_request_rate_limiter import BadRequestRateLimiter

from lms.djangoapps.pending_user.models import PendingUser, clean_phone, generate_otp
from .utils import JwtManager, validate_password, send_sms, send_otp_to_phone

AUDIT_LOG = logging.getLogger("audit")
SECRET_KEY = 'secret_key'

class SendOTP(APIView):
    """
    Send OTP to a phone number
    """
    @method_decorator(csrf_protect)
    def post(self, request, *args, **kwargs):
        # Apply rate limiting for bad requests and return an error response if the limit is exceeded
        limiter = BadRequestRateLimiter()
        limiter.tick_bad_request_counter(request)
        if limiter.is_rate_limit_exceeded(request):
            AUDIT_LOG.warning("Rate limit exceeded in password_reset")
            return Response(
                {"error": True, "error_description": "Rate limit exceeded"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_number = request.data.get("phone")
        response = send_otp_to_phone(phone_number)
        return response


class VerifyToChangePass(APIView):
    """
    Verify phone number to change password
    """
    @method_decorator(csrf_protect)
    def post(self, request, *args, **kwargs):
        phone_number = request.data.get("phone")

        cleaned_phone = clean_phone(phone_number)
        if not cleaned_phone:
            return Response(
                {"error": True, "error_description": "Invalid phone number"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conflicts = check_account_exists(cleaned_phone)
        if not conflicts:
            return Response(
                {"error": 'user_not_found', "error_description": "User not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response = send_otp_to_phone(cleaned_phone)
        return response

class ValidateOTP(APIView):
    """
    Validate OTP for a pending user
    """
    # @method_decorator(csrf_exempt)
    def post(self, request, *args, **kwargs):
        base64_phone = request.data.get("phone")
        otp = request.data.get("otp")
        phone_number = urlsafe_base64_decode(base64_phone)
        cleaned_phone = clean_phone(phone_number)
        if not cleaned_phone:
            return Response(
                {"error": True, "error_description": "Invalid phone number"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending_user = PendingUser.objects.filter(phone=cleaned_phone).first()
        if pending_user is None:
            return Response(
                {"error": True, "error_description": "User does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pending_user.verification_code == otp and pending_user.is_valid():
            pending_user.verification_code = None
            pending_user.save()

            payload = {"phone": cleaned_phone}
            jwt_manager = JwtManager(SECRET_KEY)
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
    Get password and create new user
    """
    @method_decorator(csrf_protect)
    def post(self, request, *args, **kwargs):
        password = request.data.get("password")
        jwt_token = request.data.get("jwt")
        course_id = request.data.get("course_id")
        lead_id = request.data.get("lead_id")

        if not validate_password(password):
            return Response(
                {"error": True, "error_description": "Invalid password"},
                status=status.HTTP_400_BAD_REQUEST,
        )

        jwt_manager = JwtManager(SECRET_KEY)
        payload = jwt_manager.decode(jwt_token)
        exp = payload.get('exp')
        phone_number = payload.get("phone")

        if exp is not None:
            current_time = time.time()
            if current_time > exp:
                return Response(
                    {"error": 'token_expired', "error_description": "JWT token has expired"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
                {"error": 'user_already_exists', "error_description": "User already exists"},
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

        if course_id and lead_id:
            # send post request to API to enroll trial
            enroll_trial_url = 'https://portal.funix.edu.vn/api/v1/private_teacher/enroll_trial'
            enroll_trial_data = {
                'lead_id': lead_id,
                'course_id': course_id,
            }
            try:
                response = requests.post(enroll_trial_url, json=enroll_trial_data, timeout=180)
                response.raise_for_status()  # Raises a HTTPError if the status is 4xx, 5xx
            except requests.exceptions.HTTPError as err:
                return Response(
                    {"error": True, "error_description": str(err)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if response:
                data = response.json()
                if data['code'] != 201:
                    return Response(
                        {"error": True, "error_description": 'Enroll trial fail'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        AUDIT_LOG.info("New user created: %s", new_user.username)
        response = JsonResponse({"success": True}, status=status.HTTP_200_OK)
        set_logged_in_cookies(request, response, new_user)
        return response


class ChangePasswordAPI(APIView):
    """
    Change password for existing user
    """
    @method_decorator(csrf_protect)
    def post(self, request, *args, **kwargs):
        password = request.data.get("password")
        jwt_token = request.data.get("jwt")

        if not validate_password(password):
            return Response(
                {"error": True, "error_description": "Invalid password"},
                status=status.HTTP_400_BAD_REQUEST,
        )

        jwt_manager = JwtManager(SECRET_KEY)
        payload = jwt_manager.decode(jwt_token)
        exp = payload.get('exp')
        phone_number = payload.get("phone")

        if exp is not None:
            current_time = time.time()
            if current_time > exp:
                return Response(
                    {"error": 'token_expired', "error_description": "JWT token has expired"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cleaned_phone = clean_phone(phone_number)
        if not cleaned_phone:
            return Response(
                {"error": 'invalid_token', "error_description": "Invalid JWT"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        conflicts = check_account_exists(cleaned_phone)
        if not conflicts:
            return Response(
                {"error": 'user_not_found', "error_description": "User not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        #  Set password for existing user
        user = User.objects.get(username=cleaned_phone)
        user.set_password(password)
        user.save()

        # Authenticate user
        user = authenticate(username=cleaned_phone, password=password)
        login(request, user)
        request.session.set_expiry(0)

        response = JsonResponse({"success": True}, status=status.HTTP_200_OK)
        set_logged_in_cookies(request, response, user)
        return response


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def register_with_phone_number(request):
    redirect_to = get_next_url_for_login_page(request)
    # If we're already logged in, redirect to the dashboard
    if request.user.is_authenticated():
        return redirect(redirect_to)

    return render_to_response('pending_user/register_with_phone_number.html', {})


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def forgot_password(request):
    redirect_to = get_next_url_for_login_page(request)
    # If we're already logged in, redirect to the dashboard
    if request.user.is_authenticated():
        return redirect(redirect_to)

    return render_to_response('pending_user/forgot_password.html', {})


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def verify_otp_to_change_pass(request):
    redirect_to = get_next_url_for_login_page(request)
    # If we're already logged in, redirect to the dashboard
    if request.user.is_authenticated():
        return redirect(redirect_to)

    return render_to_response('pending_user/verify_otp_to_change_pass.html', {})


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def create_password(request):
    redirect_to = get_next_url_for_login_page(request)
    # If we're already logged in, redirect to the dashboard
    if request.user.is_authenticated():
        return redirect(redirect_to)

    return render_to_response('pending_user/create_password.html', {})


@require_http_methods(['GET'])
@ensure_csrf_cookie
@xframe_allow_whitelisted
def change_password(request):
    redirect_to = get_next_url_for_login_page(request)
    # If we're already logged in, redirect to the dashboard
    if request.user.is_authenticated():
        return redirect(redirect_to)

    return render_to_response('pending_user/change_password.html', {})
