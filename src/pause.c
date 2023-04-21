#include <R.h>
#include <Rdefines.h>

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/time.h>
#endif

double get_time_ms(void) {
#ifdef _WIN32
  LARGE_INTEGER time_var, frequency;
  QueryPerformanceCounter(&time_var);
  QueryPerformanceFrequency(&frequency);

  return (double)time_var.QuadPart / (double)frequency.QuadPart;

#else
  struct timeval tv;

  gettimeofday(&tv, NULL);
  return (double)tv.tv_sec + (double)tv.tv_usec / 1000000;
#endif
}

SEXP profvis_pause (SEXP seconds) {
  if (TYPEOF(seconds) != REALSXP)
    error("`seconds` must be a numeric");

  double start = get_time_ms();
  double sec = asReal(seconds);

  while(get_time_ms() - start < sec) {
    R_CheckUserInterrupt();
  }

  return R_NilValue;
}
