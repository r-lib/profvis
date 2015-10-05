#' Run an R expression and record profiling information
#'
#' @param expr Code to profile.
#' @param interval Interval for profiling samples, in seconds.
#' @param prof_file Name of an Rprof output file in which to save profiling
#'   data. If \code{NULL} (the default), a temporary file will be used and
#'   automatically removed when the function exits.
#'
#' @seealso \code{\link{Rprof}} for more information about how the profiling
#'   data is collected.
#' @export
prof <- function(expr, interval = 0.01, prof_file = NULL) {
  remove_on_exit <- FALSE
  if (is.null(prof_file)) {
    prof_file <- tempfile(fileext = ".prof")
    remove_on_exit <- TRUE
  }

  # Keep original expression source code
  expr_source <- attr(substitute(expr), "wholeSrcref", exact = TRUE)
  expr_source <- attr(expr_source, "srcfile", exact = TRUE)$lines

  gc()
  Rprof(prof_file, interval = interval, line.profiling = TRUE)
  on.exit(Rprof(NULL), add = TRUE)
  if (remove_on_exit)
    on.exit(unlink(prof_file), add = TRUE)

  tryCatch(
    force(expr),
    error = function(e) NULL,
    interrupt = function(e) NULL
  )
  Rprof(NULL)

  parse_rprof(prof_file, expr_source)
}
