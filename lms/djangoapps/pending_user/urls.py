from django.conf.urls import url
from .views import SendOTP, ValidateOTP, CreatePasswordAPI, VerifyToChangePass

urlpatterns = [
    url(r'^validate-otp$', ValidateOTP.as_view(), name='validate_otp'),
    url(r'^create-password$', CreatePasswordAPI.as_view(), name='create_password_api'),
    url(r'^send-otp$', SendOTP.as_view(), name='send_otp'),
    url(r'^verify-to-change-pass$', VerifyToChangePass.as_view(), name='verify_to_change_pass'),
]