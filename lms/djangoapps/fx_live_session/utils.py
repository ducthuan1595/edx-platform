"""
Utility methods for the FX Live Session app
"""
import requests
import logging

log = logging.getLogger(__name__)

base_url = 'https://portal-staging.funix.edu.vn/api/v1'


def get_live_session_data(user_email):
    """
    Returns the live session data for the given user email.

    Args:
        user_email (str): The email of the user.

    Returns:
        dict: A dictionary containing the live session data.
    """
    student_api_url = u'{base_url}/live/student'.format(base_url=base_url)
    params = {'student_email': user_email}

    live_session_data = {
        'live_session': None,
        'mentor': None,
        'tutor': None
    }
    try:
        response = requests.get(student_api_url, params=params, timeout=5)
        response.raise_for_status()
    except requests.exceptions.HTTPError as http_err:
        log.error(u'HTTP error occurred: {err}'.format(err=http_err))
        return live_session_data
    except requests.exceptions.Timeout:
        log.error('The request timed out')
        return live_session_data
    except Exception as err:
        log.error(u'Other error occurred: {err}'.format(err=err))
        return live_session_data

    data = response.json()
    if data and 'data' in data:
        if 'live_session' in data['data']:
            live_session_data['live_session'] = data['data']['live_session']
        if 'mentor' in data['data']:
            live_session_data['mentor'] = data['data']['mentor']
        if 'tutor' in data['data']:
            live_session_data['tutor'] = data['data']['tutor']
    
    return live_session_data
    

def get_course_list():
    """
    Returns the list of courses available for the current user.

    Returns:
        list: A list of courses available for the current user.
    """
    courses_api_url = u'{base_url}/live/courses'.format(base_url=base_url)

    try:
        response = requests.get(courses_api_url, timeout=5)
        response.raise_for_status()
    except requests.exceptions.HTTPError as http_err:
        log.error(u'HTTP error occurred: {err}'.format(err=http_err))
        return []
    except requests.exceptions.Timeout:
        log.error('The request timed out')
        return []
    except Exception as err:
        log.error(u'Other error occurred: {err}'.format(err=err))
        return []

    data = response.json()
    if data and 'data' in data and 'course_list' in data['data']:
        return data['data']['course_list']
    else:
        return []


def get_private_teacher_course(useremail):
    """
    Returns the list of courses available for the current user.

    Returns:
        list: A list of courses available for the current user.
    """
    courses_api_url = u'{base_url}/private_teacher/enrolled_course'.format(base_url=base_url)
    params = {'email': useremail}

    try:
        response = requests.get(courses_api_url, params=params, timeout=10)
        response.raise_for_status()
    except requests.exceptions.HTTPError as http_err:
        log.error(u'HTTP error occurred: {err}'.format(err=http_err))
        return []
    except requests.exceptions.Timeout:
        log.error('The request timed out')
        return []
    except Exception as err:
        log.error(u'Other error occurred: {err}'.format(err=err))
        return []

    data = response.json()
    if data and 'data' in data:
        return data['data']
    else:
        return []