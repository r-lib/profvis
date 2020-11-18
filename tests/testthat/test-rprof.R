
test_that("`rprof_lines()` collects profiles", {
  f <- function() pause(0.1)

  out <- rprof_lines(f())
  expect_snapshot(writeLines(unique(out)))

  expect_snapshot0(cat_rprof(f()))
})

test_that("`filter.callframes` filters out intervening frames", {
  # Chains of calls are kept
  f <- function() g()
  g <- function() h()
  h <- function() pause(0.1)
  expect_snapshot0(cat_rprof(f(), filter.callframes = TRUE))

  # Intervening frames are discarded
  f <- function() identity(identity(pause(0.1)))
  expect_snapshot0(cat_rprof(f(), filter.callframes = TRUE))
})

test_that("`pause()` does not include .Call() when `line.profiling` is set", {
  f <- function() pause(0.1)

  # `pause()` should appear first on the line
  out <- unique(rprof_lines(f(), line.profiling = TRUE))
  expect_true(any(grepl("^\"pause\" ", out)))
})
