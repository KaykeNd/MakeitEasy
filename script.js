const filters = document.querySelectorAll('.filter');
const courses = document.querySelectorAll('.course');

filters.forEach((button) => {
  button.addEventListener('click', () => {
    const level = button.dataset.filter;

    filters.forEach((b) => b.classList.toggle('active', b === button));
    courses.forEach((course) => {
      course.hidden = level !== 'todos' && course.dataset.level !== level;
    });
  });
});
