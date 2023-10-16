const pathname = window.location.pathname;

const course_key = pathname.split('/')[2];

const fx_tab = document.getElementById("fx_score_tab");

fx_tab.href = '/courses/' + course_key + '/score';
