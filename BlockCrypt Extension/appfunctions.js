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