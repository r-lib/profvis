#include <Rinternals.h>
#include <R_ext/Rdynload.h>


extern SEXP profvis_pause (SEXP seconds);

static const R_CallMethodDef callMethods[]  = {
  { "profvis_pause", (DL_FUNC) &profvis_pause, 1 },
  { NULL, NULL, 0 }
};

void R_init_profvis(DllInfo *dll) {
  R_registerRoutines(dll, NULL, callMethods, NULL, NULL);
  R_useDynamicSymbols(dll, FALSE);
  R_forceSymbols(dll, TRUE);
}
