"""
Score Dashboard Views
"""

import logging

from django.http import HttpResponseServerError
from django.utils.translation import gettext as _
from django.utils.translation import gettext_noop
from django.views.decorators.cache import cache_control
from django.views.decorators.csrf import ensure_csrf_cookie
from opaque_keys import InvalidKeyError
from opaque_keys.edx.keys import CourseKey

from edxmako.shortcuts import render_to_response
from courseware.courses import get_course_by_id
from xmodule.tabs import CourseTab

log = logging.getLogger(__name__)

class ScoreDashboardTab(CourseTab):
    """
    Defines the Score Dashboard view type that is shown as a course tab.
    """
    type='score'
    title = gettext_noop('Score')
    view_name = "score_dashboard"
    is_dynamic = True

    @classmethod
    def is_enabled(cls, course, user=None):
        return True;

@ensure_csrf_cookie
@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def score_dashboard(request, course_id):  # lint-amnesty, pylint: disable=too-many-statements
    """ Display the instructor dashboard for a course. """
    try:
        course_key = CourseKey.from_string(course_id)
    except InvalidKeyError:
        log.error("Unable to find course with course key %s while loading the Instructor Dashboard.", course_id)
        return HttpResponseServerError()

    course = get_course_by_id(course_key, depth=0)

    context = {
        'course': course
    }

    return render_to_response('fx_score/score_dashboard.html', context)
