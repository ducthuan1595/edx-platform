"""
This is the live session context_processor module.
Currently the only context_processor detects whether request.user has a permission should be displayed in the
navigation.  We want to do this in the context_processor to
1) keep database accesses out of templates (this led to a transaction bug with user email changes)
2) because navigation.html is "called" by being included in other templates, there's no "views.py" to put this.
"""

from .utils import get_live_session_data


def get_role_in_live_session(request):
    if not request.user.is_authenticated() and not hasattr(request.user, 'email'):
        return {'live_session': False}

    user_email = request.user.email
    live_session = get_live_session_data(user_email)

    return {'live_session': live_session}
