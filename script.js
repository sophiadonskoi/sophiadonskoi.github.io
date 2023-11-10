const slider = document.querySelector('.slider');
const sliderLeftBtn = document.querySelector('.slider-nav-left');
const sliderRightBtn = document.querySelector('.slider-nav-right');

// Get the div for the slider
let sliderItems = document.querySelectorAll('.slider a');
const sliderItemWidth = sliderItems[0].offsetWidth + 20; // 20px margin-right
let numSliderItems = sliderItems.length;
let currentIndex = 0;
let intervalId;

// Start the automatic sliding
startSlider();

// Pause on hover
slider.addEventListener('mouseover', () => {
  clearInterval(intervalId);
});

// Resume sliding on mouseout
slider.addEventListener('mouseout', () => {
  startSlider();
});

function startSlider() {
  intervalId = setInterval(() => {
    currentIndex = (currentIndex + 1) % numSliderItems;
    updateSliderPosition();
  }, 2000);
}

function updateSliderPosition() {
  if (currentIndex === numSliderItems - 2) {
    slider.style.transform = `translateX(0)`;
    currentIndex = 0
  }
  else{
  slider.style.transform = `translateX(-${currentIndex * sliderItemWidth}px)`;
  }
}

// Get the background element
var background = document.getElementById('background');
