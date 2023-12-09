from django.conf.urls import url
from .views import ValidateOTP

urlpatterns = [
    url(r'^validate-otp$', ValidateOTP.as_view(), name='validate_otp'),
]