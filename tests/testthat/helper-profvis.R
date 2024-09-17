TEST_PAUSE_TIME <- 0.050

call_stacks <- function(x) {
  prof <- x$x$message$prof
  stacks <- split(prof$label, prof$time)
  vapply(stacks, paste, "", collapse = " ")
}

modal_call <- function(x) {
  modal_value0(call_stacks(x))
}

profile_calls <- function(x) {
  prof <- x$x$message$prof
  stacks <- split(prof$label, prof$time)
  vapply(stacks, paste, "", collapse = " ")
}

profile_mode <- function(x) {
  modal_value0(profile_calls(x))
}
