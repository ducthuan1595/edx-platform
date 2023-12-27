import base64
import json
import requests
import logging
import time

from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status
from lms.djangoapps.pending_user.models import PendingUser, clean_phone, generate_otp

from jwkest.jwk import SYMKey
from jwkest.jws import JWS

AUDIT_LOG = logging.getLogger("audit")


def send_sms(message, phone_number):
    """Send SMS to the given phone number."""
    access_token = get_token()
    if access_token is None:
        return {
            "error": "invalid_request",
            "error_description": "Cannot get access token from FPT SMS API."
        }

    url = "https://app.sms.fpt.net/api/push-brandname-otp"
    headers = {'Content-Type': 'application/json'}

    # encode message to base64
    message = message.encode('ascii')
    message = base64.b64encode(message)

    data = {
        "access_token": access_token,
        "session_id": "5c22be0c0396440829c98d7ba124092020145753419",
        "BrandName": "FUNIX",
        "Phone": phone_number,
        "Message": message,
        "RequestId":"sms_otp_from_lms"
    }
    response = requests.post(url, headers=headers, data=json.dumps(data))

    AUDIT_LOG.info("333333333333333333333333333333333333333333333333")
    AUDIT_LOG.info("Request to push-brandname-otp: %s", data)
    AUDIT_LOG.info("Response from push-brandname-otp: %s", response.json())
    AUDIT_LOG.info("333333333333333333333333333333333333333333333333")

    return response.json()


def get_token():
    """Get token from FPT SMS API."""
    url = "https://app.sms.fpt.net/oauth2/token"

    # FX TODO: get client_id and client_secret from .env
    payload = json.dumps({
        "client_id": "",
        "client_secret": "",
        "scope": "send_brandname_otp send_brandname",
        "session_id": "5c22be0c0396440829c98d7ba124092020145753419",
        "grant_type": "client_credentials"
    })
    headers = {
        'Content-Type': 'application/json'
    }

    response = requests.request("POST", url, headers=headers, data=payload)

    AUDIT_LOG.info("333333333333333333333333333333333333333333333333")
    AUDIT_LOG.info("Get token from FPT SMS API: %s", response.json())
    AUDIT_LOG.info("333333333333333333333333333333333333333333333333")

    if 'access_token' not in response.json():
        return None

    return response.json()['access_token']


def validate_password(password):
    """Validate password."""
    if len(password) < 4:
        return False

    return True


# FX TODO: add docstring
class JwtManager:
    def __init__(self, secret):
        self.key = SYMKey(key=secret, alg="HS256")

    def encode(self, payload):
        # Add an 'exp' claim that expires 5 minutes from now
        payload['exp'] = int(time.mktime((datetime.now() + timedelta(minutes=5)).timetuple()))
        
        jws = JWS(payload, alg="HS256")
        jwt_token = jws.sign_compact(keys=[self.key])
        return jwt_token

    def decode(self, jwt_token):
        jws = JWS()
        payload = jws.verify_compact(jwt_token, keys=[self.key])
        return payload


def send_otp_to_phone(phone_number):
    cleaned_phone = clean_phone(phone_number)
    if not cleaned_phone:
        return Response(
            {"error": True, "error_description": "Invalid phone number"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    pending_user, created = PendingUser.objects.get_or_create(phone=cleaned_phone)
    
    pending_user.verification_code = generate_otp()
    pending_user.created_at = timezone.now()
    pending_user.save()

    message = str(pending_user.verification_code) + " la ma OTP kich hoat tai khoan cua quy khach. Ma co hieu luc trong 5 phut"
    response = send_sms(message, pending_user.phone)
    AUDIT_LOG.info("Ma OTP cua ban la: %s" % pending_user.verification_code)
    AUDIT_LOG.info(response)
    if 'error' in response:
        return Response(
            {"error": True, "error_description": "Send OTP fail"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    AUDIT_LOG.info("OTP sent to phone number: %s" % cleaned_phone)
    return Response({"success": True}, status=status.HTTP_200_OK)