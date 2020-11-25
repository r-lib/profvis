
TEST_PAUSE_TIME <- 0.050

cat_rprof <- function(expr, ..., rerun = "pause") {
  out <- inject(rprof_lines({{ expr }}, ..., rerun = rerun))
  out <- modal_value0(out)

  if (is_null(out)) {
    abort("Unexpected profile")
  }

  cat(paste0(out, "\n"))
}

expect_snapshot0 <- function(expr, cran = TRUE) {
  # Prevent `expect_snapshot()` from processing injection operators
  quo <- new_quosure(substitute(expr), parent.frame())
  expect_snapshot(!!quo, cran = cran)
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
