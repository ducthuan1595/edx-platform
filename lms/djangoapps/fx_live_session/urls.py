from django.conf import settings
from django.conf.urls import patterns, url

urlpatterns = []

urlpatterns += patterns(
    'fx_live_session.views',
    url(r'^', 'live_session', name='live_session'),
)
