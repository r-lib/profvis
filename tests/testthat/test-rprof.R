
skip_on_cran_if_not_ci()

test_that("`rprof_lines()` collects profiles", {
  f <- function() pause(TEST_PAUSE_TIME)

  out <- rprof_lines(f(), rerun = "pause")
  expect_snapshot(writeLines(modal_value0(out)))

  expect_snapshot0(cat_rprof(f()))
})

test_that("`filter.callframes` filters out intervening frames", {
  skip_if_not(has_simplify())

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
  zap <- function(lines) modal_value0(zap_trailing_space(zap_srcref(zap_meta_data(lines))))

  metadata <- rprof_lines(
    f(),
    line.profiling = TRUE,
    memory.profiling = TRUE,
    filter.callframes = FALSE,
    rerun = "pause"
  )
  expect_snapshot(writeLines(zap(metadata)))

  metadata_simplified <- rprof_lines(
    f(),
    line.profiling = TRUE,
    memory.profiling = TRUE,
    filter.callframes = TRUE,
    rerun = "pause"
  )
  expect_snapshot(writeLines(zap(metadata_simplified)))
})

test_that("`pause()` does not include .Call() when `line.profiling` is set", {
  f <- function() pause(TEST_PAUSE_TIME)

  # `pause()` should appear first on the line
  out <- modal_value(rprof_lines(f(), line.profiling = TRUE, rerun = "pause"))
  expect_true(grepl("^\"pause\" ", out))
})

test_that("srcrefs do not prevent suffix replacement", {
  line <- ":1509169:3184799:91929040:0:\"pause\" 1#1 \"f\" \"doTryCatch\" \"tryCatchOne\" \"tryCatchList\" \"doTryCatch\" \"tryCatchOne\" \"tryCatchList\" \"tryCatch\" 2#193 \"with_profvis_handlers\" 2#151 \"profvis\" "
  suffix <- "\"doTryCatch\" \"tryCatchOne\" \"tryCatchList\" \"doTryCatch\" \"tryCatchOne\" \"tryCatchList\" \"tryCatch\" 2#193 \"with_profvis_handlers\" 2#151 \"profvis\" $"
  re <- gsub_srcref_as_wildcards(suffix)
  expect_equal(
    gsub(re, "", line),
    ":1509169:3184799:91929040:0:\"pause\" 1#1 \"f\" "
  )
})
