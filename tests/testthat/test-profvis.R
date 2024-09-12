test_that("Irrelevant stack is trimmed from profiles (#123)", {
  skip_on_cran()
  skip_on_covr()

  f <- function() pause(TEST_PAUSE_TIME)

  out <- repro_profvis(f(), simplify = FALSE)
  expect_equal(profile_mode(out), "pause f")

  out <- profvis(f(), simplify = TRUE, rerun = "pause", interval = 0.005)
  expect_equal(profile_mode(out), "pause f")

  out <- repro_profvis(f(), simplify = TRUE)
  expect_equal(profile_mode(out), "pause f")
})

test_that("defaults to elapsed timing", {
  skip_on_cran()
  skip_on_covr()
  skip_if_not(has_event())

  f <- function() Sys.sleep(TEST_PAUSE_TIME)

  out <- repro_profvis(f(), rerun = "Sys.sleep")
  expect_equal(profile_mode(out), "Sys.sleep f")
})
