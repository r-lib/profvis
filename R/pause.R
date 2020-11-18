#' Pause an R process
#'
#' This function pauses an R process for some amount of time. It differs from
#' \code{\link{Sys.sleep}} in that time spent in \code{pause} will show up in
#' profiler data. Another difference is that \code{pause} uses up 100% of a CPU,
#' whereas \code{Sys.sleep} does not.
#'
#' @examples
#' # Wait for 0.5 seconds
#' pause(0.5)
#'
#' @param seconds Number of seconds to pause.
#' @useDynLib profvis, .registration = TRUE, .fixes = "c_"
#' @export
pause <- function(seconds) {
  .Call(c_profvis_pause, as.numeric(seconds))
}

# This guarantees that `pause()` is always compiled, even on
# `load_all()`. This in turn ensures consistent profile output: if the
# function is not compiled, `.Call()` is included in the profile.
on_load(pause <- compiler::cmpfun(pause))
