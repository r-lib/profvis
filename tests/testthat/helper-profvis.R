
TEST_PAUSE_TIME <- 0.01

cat_rprof <- function(expr, ..., pattern = "pause") {
  out <- inject(rprof_lines({{ expr }}, ..., pattern = pattern))
  out <- modal_value(out)

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

repro_profvis <- function(expr, ..., rerun = TRUE, interval = 0.005) {
  inject(profvis({{ expr }}, ..., rerun = rerun, interval = interval))
}
