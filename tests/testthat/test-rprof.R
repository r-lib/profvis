
test_that("`rprof_lines()` collects profiles", {
  f <- function() pause(0.1)

  out <- rprof_lines(f())
  expect_snapshot(writeLines(unique(out)))

  expect_snapshot0(cat_rprof(f()))
})

test_that("`pause()` does not include .Call() when `line.profiling` is set", {
  f <- function() pause(0.1)

  # `pause()` should appear first on the line
  out <- unique(rprof_lines(f(), line.profiling = TRUE))
  expect_true(any(grepl("^\"pause\" ", out)))
})
