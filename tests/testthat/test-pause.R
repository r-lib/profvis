test_that("pause takes expected time", {
  time <- system.time(pause(0.2))[[3]]
  # system.time is a little inaccurate so allow 10% padding
  expect_true(abs(time - 0.2) < 1e-2)
})

test_that("works with integers", {
  expect_no_error(pause(0L))
})

test_that("pause has no srcrefs", {
  expect_equal(attr(pause, "srcref"), NULL)
})

test_that("checks its inputs", {
  expect_snapshot(error = TRUE, {
    pause(c(1, 2))
    pause("a")
  })
})
