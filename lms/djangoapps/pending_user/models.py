import random
import re

from django.db import models
from django.utils import timezone

class PendingUser(models.Model):
    phone =  models.CharField(max_length=20)
    password = models.CharField(max_length=128, blank=True, null=True)      # FX TODO: encrypt password/hide password in admin
    verification_code = models.CharField(max_length=8, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.phone)
    
    def is_valid(self):
        """10 mins OTP validation"""
        lifespan_in_seconds = float(10 * 60)
        now = timezone.now()
        time_diff = now - self.created_at
        time_diff_in_seconds = time_diff.total_seconds()
        if time_diff_in_seconds >= lifespan_in_seconds:
            return False
        return True


# FX TODO: move to utils.py
def generate_otp():
    """Generate 6 digit OTP"""
    otp = random.randint(100000, 999999)
    otp = 123456    # FX TODO: remove this line after testing
    return otp


def clean_phone(number):
        """Validates number start with 84 or 0, then 9 digits"""
        number_pattern = re.compile(r'^(?:84|0)\d{9}$')
        result = number_pattern.match(number)
        if result:
            if number.startswith('0'): 
                return '84' + number[1:]
            return number
        else:
            return 0    