#' @export
prof <- function(code, interval = 0.01, torture = FALSE) {
  prof <- lineprof::lineprof(code, interval, torture)

  # Get files
  files <- lapply(paths(prof), function(filename) {
    list(
      filename = filename,
      content = readChar(filename, 1e6)
    )
  })

  list(
    prof = prof,
    files = files
  )
}

# Return paths used in a lineprof object
paths <- function(x) {
  paths <- unique(unlist(lapply(x$ref, function(x) x$path)))
  paths[!is.na(paths)]
}
