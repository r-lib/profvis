#' Pause an R process
#'
#' This function pauses an R process for some amount of time. It differs from
#' \code{\link{Sys.sleep}} in that time spent in \code{pause} will show up in
#' profiler data. Another difference is that \code{pause} uses up 100% of a CPU,
#' whereas \code{Sys.sleep} does not.
#'
#' @param seconds Number of seconds to pause.
#' @export
pause <- function(seconds) {
  # Coerce time to numeric so that we have a nicer stack trace in the profiler
  end <- as.numeric(Sys.time() + seconds)
  while (as.numeric(Sys.time()) < end) {
  }
}
