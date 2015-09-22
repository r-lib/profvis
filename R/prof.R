#' @export
prof <- function(code, interval = 0.01, keep_prof = FALSE) {
  prof_path <- tempfile(fileext = ".prof")

  gc()
  Rprof(prof_path, interval = interval, line.profiling = TRUE)
  on.exit(Rprof(NULL), add = TRUE)
  tryCatch(
    force(code),
    error = function(e) NULL,
    interrupt = function(e) NULL
  )
  Rprof(NULL)

  parse_rprof(prof_path)
}
