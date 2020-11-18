
test_that("`rprof_lines()` collects profiles", {
  f <- function() pause(0.1)

  out <- rprof_lines(f())
  expect_snapshot(writeLines(unique(out)))

  expect_snapshot0(cat_rprof(f()))
})
