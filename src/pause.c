#include <R.h>
#include <Rdefines.h>
#include <time.h>

SEXP C_pause (SEXP seconds) {
  if (TYPEOF(seconds) != REALSXP)
    error("`seconds` must be a numeric");

  time_t start = time(NULL);
  double sec = asReal(seconds);

  while(difftime(time(NULL), start) < sec) {
    R_CheckUserInterrupt();
  }

  return R_NilValue;
}
