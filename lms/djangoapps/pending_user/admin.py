from django.contrib import admin
from .models import PendingUser

class PendingUserAdmin(admin.ModelAdmin):
    list_display = ('phone', 'verification_code', 'created_at')

admin.site.register(PendingUser, PendingUserAdmin)