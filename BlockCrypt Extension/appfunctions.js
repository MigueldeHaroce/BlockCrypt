const body = document.getElementById('body');
const inputText = document.getElementById('inputText');
const submit = document.getElementById('access');
const submitImg = document.getElementById('submitImg');
inputText.addEventListener('focus', function() {
    body.classList.add('blurred');
    inputText.classList.add('focused');
    submit.classList.add('focused');
    submitImg.classList.add('focused');
});

inputText.addEventListener('blur', function() {
    body.classList.remove('blurred');
    inputText.classList.remove('focused');
    submit.classList.remove('focused');
    submitImg.classList.add('focused');
});

if (window.location.href.includes('retrieve.html')) {
    document.getElementById("retrieveMenuImg").addEventListener("click", function() {
        window.location.href = "save.html";
    });
}

if (window.location.href.includes('save.html')) {
    document.getElementById("retrieveMenuImg").addEventListener("click", function() {
        window.location.href = "retrieve.html";
    });
}
if (window.location.href.includes('save.html') || window.location.href.includes('retrieve.html')) {

    document.addEventListener('DOMContentLoaded', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            var currentTab = tabs[0];
            if (currentTab) {
                // Extract the URL of the current tab
                var url = currentTab.url;

                // Remove the 'https://' part
                url = url.replace(/^https?:\/\//, '');

                // Shorten the URL if it's too long
                var maxLength = 25; // Maximum length of the displayed URL
                if (url.length > maxLength) {
                    url = url.substring(0, maxLength - 3) + '...';
                }

                // Set the modified URL to the 'website' div
                document.getElementById('website').textContent = url;
            }
        });
    });
}