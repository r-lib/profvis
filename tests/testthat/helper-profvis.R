
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

profvis_modal_value <- function(prof) {
  stacks <- split(prof$label, prof$time)
  stacks <- vapply(stacks, paste, "", collapse = " ")
  modal_value0(stacks)
}

skip_on_cran_if_not_ci <- function() {
  if (!is_true(as.logical(Sys.getenv("CI")))) {
    skip_on_cran()
  }
}
