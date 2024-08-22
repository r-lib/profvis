#' Pause an R process
#'
#' This function pauses an R process for some amount of time. It differs from
#' [Sys.sleep()] in that time spent in `pause` will show up in
#' profiler data. Another difference is that `pause` uses up 100\% of a CPU,
#' whereas `Sys.sleep` does not.
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

# This guarantees that (1) `pause()` is always compiled, even on
# `load_all()` and (2) it doesn't include source references. This in
# turn ensures consistent profile output: if the function is not
# compiled and doesn't contain srcrefs, `.Call()` is never included in
# the profiles, even when `line.profiling` is set.
on_load({
  pause <- utils::removeSource(pause)
  pause <- compiler::cmpfun(pause)
})
