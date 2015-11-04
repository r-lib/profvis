#' Pause an R process
#'
#' This function pauses an R process for some amount of time. It differs from
#' \code{\link{Sys.sleep}} in that time spent in \code{pause} will show up in
#' profiler data. Another difference is that \code{pause} uses up 100% of a CPU,
#' whereas \code{Sys.sleep} does not.
#'
#' @param seconds Number of seconds to pause. Note that \code{pause} only has
#'   1-second precision.
#' @export
#' @useDynLib profvis C_pause
pause <- function(seconds) {
  .Call(C_pause, as.numeric(seconds))
}
