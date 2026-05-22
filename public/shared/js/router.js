// Canonical base-path helper. Imported by auth.js too — don't duplicate.
export function getBase() {
  const path = window.location.pathname;
  const knownDirs = ['/login/', '/admin/', '/teacher/', '/student/', '/board/'];
  for (const dir of knownDirs) {
    const idx = path.indexOf(dir);
    if (idx !== -1) return path.slice(0, idx);
  }
  return path.replace(/\/index\.html$/, '').replace(/\/$/, '');
}

export function redirectByRole(role) {
  const base = getBase();
  const routes = {
    admin:   base + '/admin/admin.html',
    teacher: base + '/teacher/teacher.html',
    student: base + '/student/student.html',
    board:   base + '/board/board.html'
  };
  const path = routes[role];
  window.location.href = path ?? (base + '/login/login.html');
}
