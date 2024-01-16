document.addEventListener('DOMContentLoaded', function() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const paramValueSource = urlParams.get('utm_source');
    const paramValueMid = urlParams.get('mid');

    if (paramValueSource && paramValueMid) {
        const hannixAcc = {
          utm_source_giasu: paramValueSource,
          mid_giasu: paramValueMid
        }
        localStorage.setItem('account_hannix', JSON.stringify(hannixAcc));
    }
});