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

  prof_data <- parse_rprof(prof_path)

  # Get filenames from profiling data
  filenames <- unique(prof_data$filename)
  # Drop NA and ""
  filenames <- filenames[!is.na(filenames)]
  filenames <- filenames[filenames != ""]

  # Get file contents
  files <- lapply(filenames, function(filename) {
    list(
      filename = filename,
      content = readChar(filename, 1e6)
    )
  })

  list(
    prof = prof_data,
    files = files
  )
}
