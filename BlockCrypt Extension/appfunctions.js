const body = document.getElementById('body');
const inputText = document.getElementById('inputText');

if (window.location.href.includes('index.html')) {
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
    
}

if (window.location.href.includes('retrieve.html')) {
    const submit = document.getElementById('get');
    const submitImg = document.getElementById('getImg');
    
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
}

if (window.location.href.includes('save.html')) {
    const submit = document.getElementById('submit');
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
}
if (window.location.href.includes('save.html') || window.location.href.includes('retrieve.html')) {

    document.addEventListener('DOMContentLoaded', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            var currentTab = tabs[0];
            if (currentTab) {
                var url = currentTab.url;

                url = url.replace(/^https?:\/\//, '');

                var maxLength = 25;
                if (url.length > maxLength) {
                    url = url.substring(0, maxLength - 3) + '...';
                }

                document.getElementById('website').textContent = url;
            }
        });
    });
}

barba.init({
    transitions: [{
      name: 'opacity-transition',
      leave(data) {
        return gsap.to(data.current.container, {
          opacity: 0
        });
      },
      enter(data) {
        return gsap.from(data.next.container, {
          opacity: 0
        });
      }
    }],
  });

    
