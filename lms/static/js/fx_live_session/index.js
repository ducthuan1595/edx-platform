$(function () {
    let selected_session_type, selected_course_option, selected_course_id, selected_date, selected_session, sessions, selected_from_date, selected_to_date;
    let reload_page = false;
    let current_history_slot_id, loading_popup = false, new_slot_id;
    const base_url = "https://portal.funix.edu.vn/api/v1/live";
    const available_schedule_url = base_url + "/available_schedule";
    const general_session_url = base_url + "/general_session";
    const require_messages = {
        selected_session_type: "Vui lòng lựa chọn hoạt động!",
        selected_course_id: "Vui lòng lựa chọn môn học!",
        selected_date: "Vui lòng chọn ngày!",
        selected_from_date: "Vui lòng chọn ngày!",
        selected_to_date: "Vui lòng chọn ngày!",
        selected_session: "Vui lòng chọn thời gian phù hợp!",
        custom_time_input: "Vui lòng nhập thời gian phù hợp với bạn!",
        support_content: "Vui lòng chọn nội dung cần hỗ trợ!",
        question: "Vui lòng nhập câu hỏi!"
    };

    if (getCurrentPageUrl().endsWith("/#history")) {
        // handle click on history tab when reload page
        $("#loading").hide();
        clickButtonById("history-tab");
        handlerOnClickHistoryTab();
    } else {
        $("#loading").show();
        setTimeout(function () {
            $("#loading").hide();
            $("#booking").show();
        }, 500);
    }

    $("#booking-tab").click(function () {
        // display booking element when click on booking tab
        $("#booking").show();
    });

    function getCurrentPageUrl() {
        return window.location.href;
    }

    // simulate click button by id
    function clickButtonById(id) {
        document.getElementById(id).click();
    }

    // sort course list. Udemy course will be on top
    course_list.sort((a, b) => {
        if (a.is_udemy && !b.is_udemy) {
            return -1;
        }
        if (!a.is_udemy && b.is_udemy) {
            return 1;
        }
        return 0;
    });
    // Define a dictionary where each key is a CSS class and each value is a filtered list of courses
    let course_lists = {
        '.selectpickerall': course_list,
        '.selectpickergeneral': course_list.filter(course => course.general === true),
        '.selectpickermentor': course_list.filter(course => course.mentor === true),
        '.selectpickertutor': course_list.filter(course => course.tutor === true)
    };

    // For each CSS class in the dictionary, populate the corresponding select element with the associated list of courses
    for (let selectClass in course_lists) {
        populateCourseSelect(course_lists[selectClass], selectClass);
    }

    // Initialize the select elements with the 'select-course' class using the selectpicker plugin
    $('.select-course').selectpicker();
    // Hide the select elements with the 'mentor', 'tutor', and 'general' classes
    $('.select-course.mentor, .select-course.tutor, .select-course.general').hide();

    // When the selected option of any of the select elements with the 'mentor', 'tutor', 
    // or 'general' classes changes, update the selected course and fetch the schedule data
    $(".selectpickermentor, .selectpickertutor, .selectpickergeneral").change(function () {
        selected_course_option = $(this).find(":selected");
        selected_course_id = selected_course_option.data("tokens");
        fetchScheduleData();
    });

    // Function to populate a select element with a given list of courses
    function populateCourseSelect(course_list, selectClass) {
        const $courseSelect = $(selectClass);
        $.each(course_list, (index, { course_title, course_code, course_id }) => {
            const optionText = course_title + ' - ' + course_code;
            $courseSelect.append($('<option>').attr({
                'data-tokens': course_id,
                'value': course_id
            }).text(optionText));
        });
    }

    // Function to clear the selected course
    function clearSelectedCourse() {
        selected_course_option = undefined;
        selected_course_id = undefined;
        $('.select-course').selectpicker('val', '');
    }

    function showSelectedCourse(selected_session_type) {
        // First, hide all select-course elements
        $('.select-course.mentor, .select-course.tutor, .select-course.general, .select-course.all').hide();

        // Then, based on the selected_session_type, show the appropriate element
        if (selected_session_type == "mentor") {
            $('.select-course.mentor').show();
        } else if (selected_session_type == "tutor") {
            $('.select-course.tutor').show();
        } else if (selected_session_type == "general") {
            $('.select-course.general').show();
        }
    }

    // Initialize the datepicker
    const $datepicker = $("#datepicker");
    const $datepicker_general = $("#datepicker-general");
    $datepicker.datepicker({
        autoclose: true,
        format: "dd/mm/yyyy", // Display format
        altFormat: "yyyy-mm-dd", // Date format for getting the value
        startDate: '0d' 
    });

    $("#datepicker-general .first input").datepicker({
        autoclose: true,
        todayHighlight: true,
        format: "dd/mm/yyyy", // Display format
        altFormat: "yyyy-mm-dd", // Date format for getting the value
        startDate: '0d' 
    }).on('changeDate', function (selected) {
        // When the date of the first datepicker changes, update the startDate of the second datepicker
        selected_from_date = selected.format('yyyy-mm-dd');
        const minDate = new Date(selected.date.valueOf());
        minDate.setDate(minDate.getDate() + 1);
        $("#datepicker-general .second input").datepicker('setStartDate', minDate);

        $("#datepicker-general .second input").datepicker('setDate', undefined);
        selected_to_date = undefined;
    });

    $("#datepicker-general .second input").datepicker({
        autoclose: true,
        format: "dd/mm/yyyy", // Display format
        altFormat: "yyyy-mm-dd", // Date format for getting the value
        startDate: '0d' 
    }).on('changeDate', function (selected) {
        selected_to_date = selected.format('yyyy-mm-dd');
        fetchScheduleData();
    });

    // Get the selected session type
    $("input[name='activity']").change(function () {
        clearSelectedCourse();
        toggleElements(false);
        selected_session_type = $("input[name='activity']:checked").val();

        if (selected_session_type == "general") {
            $datepicker.hide();
            $datepicker_general.show();
            addDateColumn();
        } else {
            $datepicker.show();
            $datepicker_general.hide();
            removeDateColumn();
        }

        showSelectedCourse(selected_session_type);
        fetchScheduleData();
    });

    // Get the selected date
    $datepicker.on('changeDate', function (e) {
        selected_date = e.format('yyyy-mm-dd');
        fetchScheduleData();
    });

    // Function to fetch schedule session data
    async function fetchScheduleData() {
        // Check if all require fields are defined
        if (selected_session_type == "general") {
            if (!selected_course_id || !selected_from_date || !selected_to_date) {
                return;
            }
        } else {
            if (!selected_session_type || !selected_course_id || !selected_date) {
                return;
            }
        }

        // Remove all table-row children from table-body
        $('.table-select-mentor-container .table-body').empty();
        // Uncheck all input elements with name 'select-session'
        $("input[name='select-session']").prop('checked', false);
        selected_session = undefined;
        sessions = [];
        $('.custom-time-section').hide();

        const url = selected_session_type == "general" ? general_session_url : available_schedule_url;
        const date = selected_session_type == "general" ? selected_from_date : selected_date;
        let request_url = url + "?course_id=" + selected_course_id + "&session_type=" + selected_session_type + "&start_date=" + date;

        if (selected_session_type == "general") {
            request_url += "&end_date=" + selected_to_date;
        }

        try {
            displayLoading();

            // Send request to API to get schedule data with params
            const response = await fetch(request_url, {
                method: 'GET',
            });
            const { code, data: schedule } = await response.json();
            hideLoading();

            if (code == 200) {
                sessions = schedule;
                appendSchedule(schedule);
                appendListMentor(schedule);
            }
        } catch (error) {
            hideLoading();
            console.error('Error:', error);
        }
    }

    function displayLoading() { $(".overlay").css("display", "flex") }

    function hideLoading() { $(".overlay").css("display", "none") }

    // Function to append schedule session data into table
    function appendSchedule(dataArray) {
        // Loop through the array and create rows
        $.each(dataArray, function (index, item) {
            // Create a new row element
            const new_row = $('<div class="table-row"></div>');

            if (selected_session_type == "general") {
                new_row.append('<div class="table-cell date">' + convertToDate(item.start_datetime) + '</div>');
            }

            new_row.append('<div class="table-cell time">' + convertToTime(item.start_datetime) + ' - ' + convertToTime(item.end_datetime) + '</div>');
            new_row.append('<div class="table-cell mentor">' + item.mentor_name + '</div>');
            new_row.append('<div class="table-cell select-column"><input class="form-check-input" type="radio" name="select-session" value="' + item.slot_id + '"></div>');
            // Append the new row to the table body
            $('.table-select-mentor-container .table-body').append(new_row);
        });

        // Add click handler to all rows 
        $('.table-select-mentor-container .table-body .table-row').click(function () {
            // Get the radio button for this row
            const radio = $(this).find('.select-column input');

            // Select the radio button
            radio.prop('checked', true);
            $('.custom-time-section').hide();
            selected_session = $("input[name='select-session']:checked").val();
        });

        // Show the table and other elements
        toggleElements(true);
        if (selected_session_type == "general") {
            $('.custom-time-container').hide();
            $('.table-select-mentor-container .mentor').css("padding-left", "2rem");
        } else {
            $('.custom-time-container').show();
        }
    }

    function addDateColumn() {
        $('.table-select-mentor-container .table-header').prepend('<div class="table-cell date">Ngày</div>');
        $('.table-select-mentor-container .mentor').css("padding-left", "2rem");
    }

    function removeDateColumn() {
        $('.table-select-mentor-container .table-header .date').remove();
        $('.table-select-mentor-container .mentor').css("padding-left", "7rem");
    }

    // Toggles the visibility of the elements with the given class name
    function toggleElements(shouldShow) {
        if (shouldShow) {
            $('.select-time-container').fadeIn();
            $('.question-container').fadeIn();
            $('.submit-button-container').fadeIn();
            $('.custom-time-container').fadeIn();
            $('.support-content-container').fadeIn();
        } else {
            $('.select-time-container').fadeOut();
            $('.question-container').fadeOut();
            $('.submit-button-container').fadeOut();
            $('.custom-time-container').fadeOut();
            $('.support-content-container').fadeOut();
        }
    }

    // Function to format datetime
    function convertToTime(datetime) {
        const date = new Date(datetime);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        return hours + ':' + (minutes < 10 ? '0' : '') + minutes;
    }

    function convertToDate(datetime) {
        const date = new Date(datetime);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        return day + '/' + month + '/' + year;
    }

    // FILTER SESSIONS
    const $filterButton = $('.select-time-container .filter-button');
    const $filterPanel = $('.select-time-container .filter-panel');
    const $selectMentorSection = $('.select-time-container .select-mentor-section');
    const $btnFilter = $('.select-time-container #btn-filter');

    $filterButton.click(function (event) {
        event.stopPropagation();
        if ($filterPanel.is(":visible")) {
            $filterPanel.fadeOut();
        } else {
            $filterPanel.fadeIn();
        }
    });

    $filterPanel.click(function (event) {
        event.stopPropagation();
    });

    function appendListMentor(data) {
        $selectMentorSection.empty();
        // Create a new select element
        const $newSelect = $('<select>', {
            class: 'select-filter-mentor selectpickerfiltermentor',
            'data-live-search': 'true',
            'data-size': '5',
            title: '- Chọn mentor -'
        });

        // Append the new select element to the selectMentorSection
        $selectMentorSection.append($newSelect);

        // Append the default option to the new select element
        $('.selectpickerfiltermentor').append($('<option>').attr({
            'data-tokens': 'all',
            'value': 'all'
        }).text('Tất cả'));

        let seen = new Set();
        $.each(data, (index, { mentor_name }) => {
            if (!seen.has(mentor_name)) {
                $('.selectpickerfiltermentor').append($('<option>').attr({
                    'data-tokens': mentor_name,
                    'value': mentor_name
                }).text(mentor_name));
                seen.add(mentor_name);
            }
        });

        // Initialize the selectpicker
        $('.selectpickerfiltermentor').selectpicker();

        // Hide dropdown menu after selecting an option
        $('.select-time-container .select-mentor-section button').click(function () {
            $('.select-time-container .select-mentor-section ul.dropdown-menu a').off('click');    // Remove any existing click event handlers from the 'a' elements within the 'ul.dropdown-menu'
            $('.select-time-container .select-mentor-section ul.dropdown-menu a').click(function () {
                $('.select-time-container .select-mentor-section div.dropdown-menu').removeClass('show');
            });
        });
    }

    // Initialize the timepicker
    $('#filter-time-from').timepicker({
        timeFormat: 'HH:mm',
        minTime: new Date(0, 0, 0, 0, 0, 0),
        maxTime: new Date(0, 0, 0, 23, 59, 59),
        startHour: 0,
        interval: 30
    });
    $('#filter-time-to').timepicker({
        timeFormat: 'HH:mm',
        minTime: new Date(0, 0, 0, 0, 0, 0),
        maxTime: new Date(0, 0, 0, 23, 59, 59),
        startHour: 0,
        interval: 30
    });

    function updateTime() {
        const time = $(this).val().split(':');
        const hours = parseInt(time[0]);
        let minutes = parseInt(time[1]);

        // Round minutes to the nearest 30 (down)
        minutes = Math.floor(minutes / 30) * 30;

        // If minutes is NaN (not a number), set it to 0
        if (isNaN(minutes)) {
            $(this).val(undefined);
        } else {
            // Update the time in the input field
            $(this).val(('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2));
        }
    }

    // Add change handler to time inputs
    $('#filter-time-from, #filter-time-to, #update-filter-time-from, #update-filter-time-to').on('change', updateTime);

    $btnFilter.click(function () {
        const $sessions = $('.table-select-mentor-container .table-body .table-row');
        clearSelectedSession();
        filterSession('.selectpickerfiltermentor', '#filter-time-from', '#filter-time-to', $sessions);
        $filterPanel.fadeOut();     // Hide filter panel
    });

    function filterSession(mentorSelector, timeFromSelector, timeToSelector, $sessions) {
        const mentor = $(mentorSelector).val();
        const timeFrom = $(timeFromSelector).val();
        const timeTo = $(timeToSelector).val();

        // Display all sessions before applying filters
        displayAllSession($sessions);

        // Apply filters
        if (mentor && mentor !== 'all') {
            hideSessionByMentor(mentor, $sessions);
        }
        if (timeFrom && timeTo) {
            hideSessionByTime(timeFrom, timeTo, $sessions);
        }
    }

    function hideSessionByMentor(mentor_name, $sessions) {
        $sessions.each(function () {
            const rowMentorName = $(this).find('div.mentor').text();
            if (rowMentorName !== mentor_name) {
                $(this).hide();
            }
        });
    }

    function displayAllSession($sessions) {
        $sessions.show();
    }

    function hideSessionByTime(timeFrom, timeTo, $sessions) {
        $sessions.each(function () {
            let rowTime = $(this).find('div.time').text();
            let rowTimeFrom = rowTime.split('-')[0].trim();
            let rowTimeTo = rowTime.split('-')[1].trim();

            // Convert times to 24-hour format
            rowTimeFrom = convertTo24Hour(rowTimeFrom);
            rowTimeTo = convertTo24Hour(rowTimeTo);
            timeFrom = convertTo24Hour(timeFrom);
            timeTo = convertTo24Hour(timeTo);

            // Convert midnight to 24:00
            rowTimeTo = convertMidnightTo24(rowTimeTo);
            timeTo = convertMidnightTo24(timeTo);

            if (rowTimeFrom < timeFrom || rowTimeTo > timeTo) {
                $(this).hide();
            }
        });
    }

    function convertTo24Hour(time) {
        const [hours, minutes] = time.split(':');
        return ('0' + hours).slice(-2) + ':' + minutes;
    }

    function convertMidnightTo24(time) {
        return time === '00:00' ? '24:00' : time;
    }

    function clearSelectedSession() {
        $('input[name="select-session"]').prop('checked', false);
        selected_session = undefined;
    }

    $(document).mouseup(function (e) {
        const $uiTimepicker = $('.ui-timepicker-container');

        const isTargetUiTimepicker = $uiTimepicker.is(e.target) || $uiTimepicker.has(e.target).length !== 0;
        const isTargetFilterPanel = $filterPanel.is(e.target) || $filterPanel.has(e.target).length !== 0;
        const isTargetUpdateFilterPanel = $updateFilterPanel.is(e.target) || $updateFilterPanel.has(e.target).length !== 0;

        // if the target of the click isn't the container nor a descendant of the container
        if (!isTargetUiTimepicker && !isTargetFilterPanel) {
            $filterPanel.fadeOut();
        }
        if (!isTargetUiTimepicker && !isTargetUpdateFilterPanel) {
            $updateFilterPanel.fadeOut();
        }
    });

    // Get the selected session
    $("input[name='select-session']").change(function () {
        selected_session = $("input[name='select-session']:checked").val();

        // Show or hide custom time input
        if (selected_session == "custom-time") {
            $('.custom-time-section').show();
        } else {
            $('.custom-time-section').hide();
        }
    });

    // Initialize the timepicker
    $('input#custom-time-input').timepicker({
        timeFormat: 'HH:mm',
        minTime: new Date(0, 0, 0, 0, 0, 0),
        maxTime: new Date(0, 0, 0, 23, 59, 59),
        startHour: 0,
        interval: 30
    });

    // Add change handler to custom time input
    $('input#custom-time-input').on('change', updateTime);
    
    // Get support content options from Portal
    async function getSupportContent() {
        let url = base_url + "/support_content";
        try {
            const response = await fetch(url, {
                method: 'GET',
            });
            const data = await response.json();
            if (data.code == 200) {
                return data.data;
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }

    // HTML for support content input
    function initSupportContentInput(content_id, content_title) {
        const supportContentInput = `
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="support-content" id="` + content_id + `" value="` + content_id + `">
                <label class="form-check-label" for="` + content_id + `">` + content_title + `</label>
            </div>
        `
        return supportContentInput;
    }

    async function initSupportContent() {
        const supportContent = await getSupportContent();
        const supportContentHtml = supportContent.map(content => initSupportContentInput(content.content_id, content.content_title)).join("");
        
        $(".support-content").html(supportContentHtml);
    }
    initSupportContent();
    
    // Add click handler to submit button
    $("#submit").click(function () {
        let checkResult = checkRequireFieldsForBookingSession();
        if (checkResult != "All variables are defined") {
            $(".missing-fields").show();
            $(".missing-fields").text(checkResult);
        } else {
            bookSession();
        }
    });

    // Function to check if all variables are defined
    function checkRequireFieldsForBookingSession() {
        if (!selected_session_type) {
            return require_messages.selected_session_type;
        }
        if (!selected_course_id) {
            return require_messages.selected_course_id;
        }
        if (selected_session_type == "general") {
            if (!selected_from_date || !selected_to_date) {
                return require_messages.selected_from_date;
            }
        } else {
            if (!selected_date) {
                return require_messages.selected_date;
            }
        }
        if (!selected_session) {
            return require_messages.selected_session;
        }
        if (selected_session == "custom-time" && !$("#custom-time-input").val()) {
            return require_messages.custom_time_input;
        }
        const supportContent = $("input[name='support-content']:checked").val();
        if (!supportContent) {
            return require_messages.support_content;
        }

        return "All variables are defined";
    }

    // Function to book session
    async function bookSession() {
        let url, payload, start_datetime_selected;

        // Define payload data and url based on session type and selected session
        if (selected_session_type == "general") {
            url = base_url + "/join_session";

            payload = {
                "student_email": user_email,
                "slot_id": selected_session,
                "student_question": $("#question").val()
            };
        } else {
            url = base_url + "/book_session";
            const supportContent = $("input[name='support-content']:checked").val();
            const supportContents = '[' + supportContent + ']'
            
            if (selected_session == "custom-time") {
                payload = {
                    "student_email": user_email,
                    "start_date": selected_date,
                    "student_question": $("#question").val(),
                    "course_id": selected_course_id,
                    "session_type": selected_session_type,
                    "proposed_plan": $("#custom-time-input").val(),
                    "content_id": supportContents
                };
            } else {
                payload = {
                    "student_email": user_email,
                    "slot_id": selected_session,
                    "student_question": $("#question").val(),
                    "course_id": selected_course_id,
                    "session_type": selected_session_type,
                    "content_id": supportContents
                };

                start_datetime_selected = sessions.find(item => item.slot_id == selected_session).start_datetime;
            }
        }

        // send POST request to url with body data is payload
        try {
            $("#loading-popup").show();
            $("#close-popup").prop("disabled", true);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            // Update UI
            $("#loading-popup").hide();
            $("#close-popup").prop("disabled", false);

            // Show popup based on response code
            if (data.code == 201) {
                if (selected_session == "custom-time") {
                    $(".order-custom-session-success").show();
                } else {
                    if (start_datetime_selected && compareDateTimes(start_datetime_selected, new Date()) < 3) {
                        const message_html = `<h2>Hệ thống đã ghi nhận đặt lịch của bạn!</h2>
                            <br/>
                            <p>Do phiên được book trong vòng 3 tiếng, bạn vui lòng chờ xác nhận phiên
                             từ phía mentor để chắc chắn phiên sẽ diễn ra. Xác nhận sẽ được gửi qua 
                             email <b>` + user_email + `</b>.</p>`
                        $(".booking-success").html(message_html);
                    }
                    $(".booking-success").show();
                }

                $("#close-popup").text("Xác nhận");
                reload_page = true;
            } else if (data.code == 200) {
                if (data.message == "Phiên đã được đặt bởi một lịch khác. Vui lòng chọn thời gian khác.") {
                    $(".session-not-available").show();
                    fetchScheduleData();
                } else {
                    $(".time-up").show();
                }
            } else if (data.code == 500 || data.code == 400) {
                $(".missing-fields").show();
                $(".missing-fields").text("Đã có lỗi xảy ra trong quá trình đặt lịch. Vui lòng liên hệ Hannah/ Hannix của bạn để được hỗ trợ");
                
                setTimeout(function () {
                    location.reload();
                }, 3000);
            }
        } catch (error) {
            $("#loading-popup").hide();
            $("#close-popup").prop("disabled", false);
            $(".missing-fields").show();
            $(".missing-fields").text("Đã có lỗi xảy ra trong quá trình đặt lịch. Vui lòng liên hệ Hannah/ Hannix của bạn để được hỗ trợ");
            console.error('Error:', error);
        }
    }

    function compareDateTimes(dateTime1, dateTime2) {
        const date1 = new Date(dateTime1);
        const date2 = new Date(dateTime2);
        const diff = (date1 - date2) / 1000 / 60 / 60;
        return diff;
    }

    // Add click handler to close popup button
    $(".modal-footer button").click(function () {
        $(".missing-fields").hide();
        $(".booking-success").hide();
        $(".session-not-available").hide();
        $(".order-custom-session-success").hide();
        $(".time-up").hide();

        if (reload_page) {
            redirectToHistoryTab();
        }
    });

    function redirectToHistoryTab() {
        if (!getCurrentPageUrl().endsWith("/#history")) {
            window.location.href = getCurrentPageUrl() + "#history";
        }
        location.reload();
    }

    // Append list session data into table when click on history tab
    $("#history-tab").click(function () {
        handlerOnClickHistoryTab();
    });

    function removeAllRowsFromTablesListSession() {
        $('.table-upcoming-session .table-body').empty();
        $('.table-took-place-session .table-body').empty();
    }

    function handlerOnClickHistoryTab() {
        removeAllRowsFromTablesListSession();
        getListSession();
    }

    // Fetch list session data from API and append to table
    async function getListSession() {
        let url = base_url + "/sessions?student_email=" + user_email;
        try {
            displayLoading();
            const response = await fetch(url, {
                method: 'GET',
            });
            const data = await response.json();
            hideLoading();

            if (data.code == 200) {
                // Filter list session by status
                const list_session = data.data;
                const upcoming_session = list_session.filter(item => ((item.session_status == "Chưa diễn ra" || item.session_status == "Chờ xác nhận") && item.student_status == "Đã đăng ký"));
                const took_place_session = list_session.filter(item => !upcoming_session.includes(item));   // took_place_session = list_session - upcoming_session

                // Sort list session by date
                const sortedUpcomingSessions = sortSessionsByDate(upcoming_session, true);
                const sortedTookPlaceSessions = sortSessionsByDate(took_place_session, false);

                // Append list session data into table
                appendListUpcomingSession(sortedUpcomingSessions);
                appendListTookPlaceSession(sortedTookPlaceSessions);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function sortSessionsByDate(sessions, isAscending) {
        return sessions.sort((a, b) => {
            const dateA = new Date(a.start_datetime);
            const dateB = new Date(b.start_datetime);
            return isAscending ? dateA - dateB : dateB - dateA;
        });
    }

    // Append list upcoming session data into table
    function appendListUpcomingSession(list_session) {
        // Loop through the array and create rows
        let has_session_can_update = false;
        $.each(list_session, function (index, item) {
            // Create a new row element
            const new_row = $('<div class="table-row align-items-center"></div>');
            new_row.append('<div class="table-cell stt">' + (index + 1) + '</div>');
            new_row.append('<div class="table-cell time">' + new Date(item.start_datetime).toLocaleString('vi-VN', { hour: 'numeric', minute: 'numeric' }) + '<br>' + ('0' + new Date(item.start_datetime).getDate()).slice(-2) + '/' + ('0' + (new Date(item.start_datetime).getMonth() + 1)).slice(-2) + '/' + new Date(item.start_datetime).getFullYear() + '</div>');
            new_row.append('<div class="table-cell activity">' + item.session_type + '</div>');
            new_row.append('<div class="table-cell course">' + item.course_id + '</div>');
            new_row.append(renderLinkZoomElement(item.zoom_link));
            new_row.append('<div class="table-cell button-column-edit">' + renderEditButton(item.zoom_link)) + '</div>';
            new_row.append('<div class="table-cell button-column"><button type="button" class="btn-cancel btn btn-primary">Hủy</button></div>');
            new_row.append('<p class="slot-id" style="display: none">' + item.slot_id + '</p>');
            new_row.append('<p class="course-id" style="display: none">' + item.course_id_id + '</p>');
            // Append the new row to the table body
            $('.table-upcoming-session .table-body').append(new_row);

            if (!item.zoom_link) {
                has_session_can_update = true;
            }
        });

        $('.btn-cancel').click(function () {
            // Reset UI
            $(".noti-container").hide();
            $(".noti-container").text("");  // clear text
            $(".update-session-container").hide();

            // Show popup with confirm cancel button
            $(".confirm-cancel-container").show();
            $("#dimmedBackground").fadeIn();
            $("#popup").fadeIn();

            // Get data of selected session to cancel
            current_history_slot_id = undefined;
            const slot_id = $(this).parent().parent().find('.slot-id').text();
            current_history_slot_id = slot_id;
        });

        $('.btn-edit').click(function () {
            // Reset UI
            $(".noti-container").hide();
            $(".noti-container").text("");  // clear text
            $(".update-warning").hide();
            $(".confirm-cancel-container").hide();

            // Show popup with update session form
            $(".update-session-container").show();
            $("#dimmedBackground").fadeIn();
            $("#popup").fadeIn();
            $(".update-session-container").show();

            // Get data of selected session to update
            current_history_slot_id = undefined;
            const slot_id = $(this).parent().parent().find('.slot-id').text();
            const course_title = $(this).parent().parent().find('.course').text();
            const time = $(this).parent().parent().find('.time').text();
            const activity = $(this).parent().parent().find('.activity').text();
            const course_id = $(this).parent().parent().find('.course-id').text();

            // Set data for update session popup
            current_history_slot_id = slot_id;
            setValueForUpdateActivity(activity);
            $('.update-course-name').text(course_title);
            $('.update-course-name').attr('disabled', true);
            $('#update-datepicker').text(time.slice(-10));
            $('#update-datepicker').attr('disabled', true);

            // Fetch schedule update data
            fetchScheduleUpdateData(course_id, time.slice(-10), activity);
        })

        if (!has_session_can_update) {
            $('.table-upcoming-session .table-cell.button-column-edit').css('display', 'none');
        }
    }

    // Render link zoom element
    function renderLinkZoomElement(zoom_link) {
        if (zoom_link) {
            return '<div class="table-cell link"> <a href="' + zoom_link + '" target="_blank">' + extractIdFromZoomLink(zoom_link) + '</a></div>';
        } else {
            return '<div class="table-cell link">Chờ xác nhận</div>';
        }
    }

    function extractIdFromZoomLink(link) {
        if (!link) {
            return "";
        }
        const regex = /j\/(\d+)/;
        const match = link.match(regex);
        if (match) {
            return match[1];
        }
        return "";
    }

    function renderEditButton(zoom_link) {
        if (zoom_link) {
            return "";
        }
        return '<button type="button" class="btn-edit btn btn-primary">Sửa</button>';
    }

    function setValueForUpdateActivity(activity) {
        switch (activity) {
            case "Mentor":
                document.getElementById("update-mentor").checked = true;
                break;
            case "Tutor":
                document.getElementById("update-tutor").checked = true;
                break;
            case "Hỏi đáp chung":
                document.getElementById("update-other").checked = true;
                break;
            default:
                break;
        }
        $("input[name='update-activity']").attr("disabled", true);
    }

    // Append list took place session data into table
    function appendListTookPlaceSession(list_session) {
        // Loop through the array and create rows
        $.each(list_session, function (index, item) {
            const cancel_reason = item.cancel_reason ? item.cancel_reason : "";
            // Create a new row element
            const new_row = $('<div class="table-row align-items-center"></div>');
            new_row.append('<div class="table-cell stt">' + (index + 1) + '</div>');
            new_row.append('<div class="table-cell time">' + new Date(item.start_datetime).toLocaleString('vi-VN', { hour: 'numeric', minute: 'numeric' }) + '<br>' + ('0' + new Date(item.start_datetime).getDate()).slice(-2) + '/' + ('0' + (new Date(item.start_datetime).getMonth() + 1)).slice(-2) + '/' + new Date(item.start_datetime).getFullYear() + '</div>');
            new_row.append('<div class="table-cell activity">' + item.session_type + '</div>');
            new_row.append('<div class="table-cell course">' + item.course_id + '</div>');
            new_row.append('<div class="table-cell session-status">' + item.session_status + '</div>');
            new_row.append('<div class="table-cell note">' + cancel_reason + '</div>');
            // Append the new row to the table body
            $('.table-took-place-session .table-body').append(new_row);
        });
    }

    // Add click handler to confirm cancel button
    $("#confirm-cancel").click(function () {
        cancelSession();
    });

    // Send cancel session request to API
    async function cancelSession() {
        let url = base_url + "/cancel_session";
        let payload = {
            "slot_id": current_history_slot_id,
            "student_email": user_email
        };
        try {
            // Hide popup and show loading
            $(".confirm-cancel-container").hide();
            $("#loading-popup-history").show();
            loading_popup = true;

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            // Update UI
            $("#loading-popup-history").hide();
            $(".noti-container").show();
            loading_popup = false;

            if (data.code == 200) {
                $(".noti-container").text("Bạn đã huỷ lịch thành công");
                reload_page = true;
            } else {
                $(".noti-container").text("Huỷ lịch thất bại. Vui lòng thử lại sau!");
            }
        } catch (error) {
            $("#loading-popup-history").hide();
            $("#closePopup").prop("disabled", false);
            $(".noti-container").text("Huỷ lịch thất bại. Vui lòng thử lại sau!");
            console.error('Error:', error);
        }
    }

    // Handle click close icon on popup when cancel session
    $("#closePopup").click(function () {
        if (loading_popup) {
            return;
        }
        current_history_slot_id = undefined;

        $("#dimmedBackground").fadeOut();
        $("#popup").fadeOut();

        if (reload_page) {
            redirectToHistoryTab();
        }
    });

    async function fetchScheduleUpdateData(course_id, start_date, session_type) {
        // Remove all table-row children from table-body
        $('.table-select-update-mentor-container .table-body').empty();
        new_slot_id = undefined;

        let start_date_array = start_date.split("/");
        let new_start_date = start_date_array[2] + "-" + start_date_array[1] + "-" + start_date_array[0];

        // Convert session type to match with API
        switch (session_type) {
            case "Mentor":
                session_type = "mentor";
                break;
            case "Tutor":
                session_type = "tutor";
                break;
            default:
                break;
        }

        const url = base_url + "/available_schedule" + "?course_id=" + course_id + "&session_type=" + session_type + "&start_date=" + new_start_date;
        try {
            displayLoading();
            const response = await fetch(url, {
                method: 'GET',
            });
            const { code, data: schedule } = await response.json();
            hideLoading();

            if (code == 200) {
                appendScheduleUpdate(schedule);
                appendListMentorUpdate(schedule);
            }
        } catch (error) {
            hideLoading();
            console.error('Error:', error);
        }
    }

    function appendScheduleUpdate(dataArray) {
        // Loop through the array and create rows
        $.each(dataArray, function (index, item) {
            // Create a new row element
            const new_row = $('<div class="table-row"></div>');
            new_row.append('<div class="table-cell time">' + convertToTime(item.start_datetime) + ' - ' + convertToTime(item.end_datetime) + '</div>');
            new_row.append('<div class="table-cell mentor">' + item.mentor_name + '</div>');
            new_row.append('<div class="table-cell select-column"><input class="form-check-input" type="radio" name="select-update-session" value="' + item.slot_id + '"></div>');
            // Append the new row to the table body
            $('.table-select-update-mentor-container .table-body').append(new_row);
        });

        // Add click handler to all rows 
        $('.table-select-update-mentor-container .table-body .table-row').click(function () {
            // Get the radio button for this row
            const radio = $(this).find('.select-column input');

            // Select the radio button
            radio.prop('checked', true);
            $('.custom-time-section').hide();
            new_slot_id = $("input[name='select-update-session']:checked").val();
        });
    }

    // FILTER SESSIONS IN UPDATE SESSION POPUP
    const $updateFilterButton = $('.update-select-time-container .filter-button');
    const $updateFilterPanel = $('.update-select-time-container .filter-panel');
    const $updateSelectMentorSection = $('.update-select-time-container .select-mentor-section');
    const $updateBtnFilter = $('.update-select-time-container #btn-filter-update');

    $updateFilterButton.click(function (event) {
        event.stopPropagation();
        if ($updateFilterPanel.is(":visible")) {
            $updateFilterPanel.fadeOut();
        } else {
            $updateFilterPanel.fadeIn();
        }
    });

    function appendListMentorUpdate(data) {
        $updateSelectMentorSection.empty();
        // Create a new select element
        const $newSelect = $('<select>', {
            class: 'select-filter-mentor selectpickerupdate',
            'data-live-search': 'true',
            'data-size': '5',
            title: '- Chọn mentor -'
        });

        // Append the new select element to the selectMentorSection
        $updateSelectMentorSection.append($newSelect);

        // Append the default option to the new select element
        $('.selectpickerupdate').append($('<option>').attr({
            'data-tokens': 'all',
            'value': 'all'
        }).text('Tất cả'));

        // Append the mentors to the new select element
        let seen = new Set();
        $.each(data, (index, { mentor_name }) => {
            if (!seen.has(mentor_name)) {
                $('.selectpickerupdate').append($('<option>').attr({
                    'data-tokens': mentor_name,
                    'value': mentor_name
                }).text(mentor_name));
                seen.add(mentor_name);
            }
        });

        // Initialize the selectpicker
        $('.selectpickerupdate').selectpicker();

        // Hide dropdown menu after selecting an option
        $('.update-select-time-container .select-mentor-section button').click(function () {
            $('.update-select-time-container .select-mentor-section ul.dropdown-menu a').off('click');    // Remove any existing click event handlers from the 'a' elements within the 'ul.dropdown-menu'
            $('.update-select-time-container .select-mentor-section ul.dropdown-menu a').click(function () {
                $('.update-select-time-container .select-mentor-section div.dropdown-menu').removeClass('show');
            });
        });
    }

    // Initialize the timepicker
    $('#update-filter-time-from').timepicker({
        timeFormat: 'HH:mm',
        minTime: new Date(0, 0, 0, 0, 0, 0),
        maxTime: new Date(0, 0, 0, 23, 59, 59),
        startHour: 0,
        interval: 30
    });
    $('#update-filter-time-to').timepicker({
        timeFormat: 'HH:mm',
        minTime: new Date(0, 0, 0, 0, 0, 0),
        maxTime: new Date(0, 0, 0, 23, 59, 59),
        startHour: 0,
        interval: 30
    });

    $updateBtnFilter.click(function () {
        const $sessions = $('.table-select-update-mentor-container .table-body .table-row');
        clearSelectedUpdateSession();
        filterSession('.selectpickerupdate', '#update-filter-time-from', '#update-filter-time-to', $sessions);
        $updateFilterPanel.fadeOut();       // Hide filter panel
    });

    function clearSelectedUpdateSession() {
        $('input[name="select-update-session"]').prop('checked', false);
        new_slot_id = undefined;
    }

    // Get the selected session
    $("input[name='select-update-session']").change(function () {
        new_slot_id = $("input[name='select-update-session']:checked").val();
    });

    // Add click handler to submit button
    $("#update").click(function () {
        if (!new_slot_id) {
            $(".update-warning").show();
        } else {
            updateSession();
        }
    });

    // Send update session request to API
    async function updateSession() {
        let url = base_url + "/add_slot";

        let payload = {
            "student_email": user_email,
            "slot_id": new_slot_id,
            "live_session_id": current_history_slot_id
        };

        try {
            $(".update-session-container").hide();
            $("#loading-popup-history").show();
            loading_popup = true;

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            // Update UI
            $("#loading-popup-history").hide();
            loading_popup = false;
            $(".noti-container").show();
            $("#close-popup").prop("disabled", false);

            if (data.code == 200) {
                $(".noti-container").text("Bạn đã thay đổi lịch thành công");
                reload_page = true;
            } else {
                $(".noti-container").text("Thay đổi lịch thất bại. Vui lòng thử lại sau!");
            }
        } catch (error) {
            $("#loading-popup-history").hide();
            $("#close-popup").prop("disabled", false);
            $(".noti-container").text("Thay đổi lịch thất bại. Vui lòng thử lại sau!");
            console.error('Error:', error);
        }
    }

    // Handle click outside popup when cancel session
    $("#dimmedBackground").click(function () {
        //  make popup have a scale animation when click outside. Just small scale and return to normal. Not fade out
        $('.popup').css('transform', 'translate(-50%, -50%) scale(1.05)');

        // Set a timeout to return to the original scale after a short delay
        setTimeout(function () {
            $('.popup').css('transform', 'translate(-50%, -50%) scale(1)');
        }, 300);
    });
})