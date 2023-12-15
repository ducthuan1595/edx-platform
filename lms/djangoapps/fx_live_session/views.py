""" Views for a live session. """

import logging
import requests

from django.conf import settings
from django.core.urlresolvers import reverse
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect
from django.views.decorators.http import require_http_methods

from edxmako.shortcuts import render_to_response
from openedx.core.djangoapps.site_configuration import helpers as configuration_helpers

from .utils import get_live_session_data, get_course_list, get_private_teacher_course

AUDIT_LOG = logging.getLogger("audit")
log = logging.getLogger(__name__)
User = get_user_model()  # pylint:disable=invalid-name


@login_required
@require_http_methods(['GET'])
def live_session(request):
    """Render the live session page.

    Args:
        request (HttpRequest)

    Returns:
        HttpResponse: 200 if the page was sent successfully
        HttpResponse: 302 if not logged in (redirect to login page)
        HttpResponse: 405 if using an unsupported HTTP method

    Example usage:

        GET /live-session

    """
    user_email = request.user.email
    live_session_data = get_live_session_data(user_email)
    live_session = live_session_data['live_session']

    if not live_session:
        return redirect(reverse('dashboard'))

    context = live_session_context(request)
    context['general'] = live_session_data['general']
    context['mentor'] = live_session_data['mentor']
    context['tutor'] = live_session_data['tutor']

    return render_to_response('fx_live_session/live_session.html', context)


def live_session_context(request):
    """
    Returns a dictionary containing the context for the live session page.

    The context contains the following keys:
    - user_email (str): The email of the current user.
    - live_session (bool): Whether the current user has a live session.
    - course_list (list): A list of courses available for the current user.

    Args:
        request (HttpRequest): The request object.

    Returns:
        dict: A dictionary containing the context for the live session page.
    """
    user_email = request.user.email
    course_list = get_course_list()

    context = {
        'user_email': user_email,
        'course_list': course_list,
    }
    return context


@login_required
@require_http_methods(['GET'])
def book_giasu(request):
    """Render the book giasu page.

    Args:
        request (HttpRequest)

    Returns:
        HttpResponse: 200 if the page was sent successfully
        HttpResponse: 302 if not logged in (redirect to login page)
        HttpResponse: 405 if using an unsupported HTTP method

    Example usage:

        GET /book-giasu

    """

    user_email = request.user.email
    private_teacher_course = get_private_teacher_course(user_email)

    context = {
        'user_email': user_email,
        'course_list': private_teacher_course,
    }

    return render_to_response('fx_live_session/book_giasu.html', context)