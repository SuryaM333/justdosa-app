export function getTimeBasedDefaultTheme(): 'light' | 'dark' {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMins = hours * 60 + minutes;

  // 9:00 AM (540m) to 5:00 PM / 17:00 (1020m) inclusive => light mode
  // 5:01 PM / 17:01 (1021m) to 8:59 AM / 08:59 (539m) => dark mode
  if (totalMins >= 540 && totalMins <= 1020) {
    return 'light';
  }
  return 'dark';
}

export function getInitialTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('just_dosa_user_override_theme');
    if (override === 'light' || override === 'dark') {
      return override;
    }
  }
  return getTimeBasedDefaultTheme();
}
