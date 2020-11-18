
test_that("`rprof_lines()` collects profiles", {
  f <- function() pause(TEST_PAUSE_TIME)

  out <- rprof_lines(f())
  expect_snapshot(writeLines(unique(out)))

  expect_snapshot0(cat_rprof(f()))
})

test_that("`filter.callframes` filters out intervening frames", {
  # Chains of calls are kept
  f <- function() g()
  g <- function() h()
  h <- function() pause(TEST_PAUSE_TIME)
  expect_snapshot0(cat_rprof(f(), filter.callframes = TRUE))

  # Intervening frames are discarded
  f <- function() identity(identity(pause(TEST_PAUSE_TIME)))
  expect_snapshot0(cat_rprof(f(), filter.callframes = TRUE))
})

test_that("stack is correctly stripped even with metadata profiling", {
  f <- function() pause(TEST_PAUSE_TIME)
  zap <- function(lines) unique(zap_srcref(zap_meta_data(lines)))

  metadata <- rprof_lines(
    f(),
    line.profiling = TRUE,
    memory.profiling = TRUE,
    filter.callframes = FALSE
  )
  expect_snapshot(writeLines(zap(metadata)))

  metadata_simplified <- rprof_lines(
    f(),
    line.profiling = TRUE,
    memory.profiling = TRUE,
    filter.callframes = TRUE
  )
  expect_snapshot(writeLines(zap(metadata_simplified)))
})

test_that("`pause()` does not include .Call() when `line.profiling` is set", {
  f <- function() pause(TEST_PAUSE_TIME)

  # `pause()` should appear first on the line
  out <- unique(rprof_lines(f(), line.profiling = TRUE))
  expect_true(any(grepl("^\"pause\" ", out)))
})
