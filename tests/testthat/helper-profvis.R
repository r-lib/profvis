
cat_rprof <- function(expr, ...) {
  out <- inject(rprof_lines({{ expr }}, ...))
  out <- unique(out)
  cat(paste(out, collapse = "\n"))
  cat("\n")
}

expect_snapshot0 <- function(expr, cran = TRUE) {
  # Prevent `expect_snapshot()` from processing injection operators
  quo <- new_quosure(substitute(expr), parent.frame())
  expect_snapshot(!!quo, cran = cran)
}
