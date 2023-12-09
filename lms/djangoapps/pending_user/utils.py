import base64
import json
import requests
import logging

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