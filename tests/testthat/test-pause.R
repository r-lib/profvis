test_that("pause takes expected time", {
  time <- system.time(pause(0.21))[[3]]
  expect_gte(time, 0.2)
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
