
TEST_PAUSE_TIME <- 0.050

cat_rprof <- function(expr, ..., rerun = "pause") {
  out <- inject(rprof_lines({{ expr }}, ..., rerun = rerun))
  out <- modal_value0(out)

  if (is_null(out)) {
    abort("Unexpected profile")
  }

  cat(paste0(out, "\n"))
}

repro_profvis <- function(expr, ..., rerun = "pause", interval = 0.010) {
  inject(profvis({{ expr }}, ..., rerun = rerun, interval = interval))
}

zap_trailing_space <- function(lines) {
  gsub(" $", "", lines)
}

profile_calls <- function(x) {
  prof <- x$x$message$prof
  stacks <- split(prof$label, prof$time)
  vapply(stacks, paste, "", collapse = " ")
}

profile_mode <- function(x) {
  modal_value0(profile_calls(x))
}
