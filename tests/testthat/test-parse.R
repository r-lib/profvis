
test_that("parsing prof files", {
  # The three lines in this file have three different kinds of call stacks.
  # They start with:
  # "test space" 1#1
  # 1#2 "test" 1#1
  # "<GC>" 1#2 "test" 1#1
  # "<GC>" "test" 1#1
  # ":"
  #
  # (The last line is empty)
  p <- parse_rprof(test_path("test-parse.prof"), expr_source = "line 1\nline 2")

  expect_identical(p$prof$time, c(1L, 2L, 2L, 3L, 3L, 3L, 4L, 4L, 5L))
  expect_identical(p$prof$depth, c(1L, 2L, 1L, 3L, 2L, 1L, 2L, 1L, 1L))
  expect_identical(p$prof$label, c("test space", "line 2", "test", "<GC>", "line 2", "test", "<GC>", "test", ":"))
  expect_identical(p$prof$filenum, c(1, 1, 1, NA, 1, 1, NA, 1, NA))
  expect_identical(p$prof$linenum, c(1, 2, 1, NA, 2, 1, NA, 1, NA))
  # Memory sizes in the test-parse.prof file were chosen to create these values
  expect_identical(p$prof$memalloc, c(136, 152, 152, 168, 168, 168, 152, 152, 152))
  expect_identical(p$prof$meminc, c(0, 16, 0, 16, 0, 0, -16, 0, 0))
  expect_identical(p$prof$filename, c("<expr>", "<expr>", "<expr>", NA, "<expr>", "<expr>", NA, "<expr>", NA))

  expect_identical(p$interval, 10)
  expect_identical(p$files,
    list(list(filename = "<expr>", content = "line 1\nline 2", normpath = "<expr>"))
  )
})

test_that("can sort profiles alphabetically (#115)", {
  prof <- eval(parse_expr(file(test_path("test-parse-sort1.R"))))

  sorted <- prof_sort(prof)

  split <- vctrs::vec_split(sorted$label, sorted$time)
  runs <- vctrs::vec_unrep(split$val)$key

  expect_equal(
    runs,
    list(
      c("pause", "foo", "f", "root"),
      c("pause", "bar", "f", "root"),
      c("pause", "foo", "root")
    )
  )

  # Regenerate `prof`
  if (FALSE) {
    root <- function() {
      for (. in 1:3) {
        f(TRUE)
        f(FALSE)
        foo()
      }
    }
    f <- function(x) if (x) foo() else bar()
    foo <- function() pause(0.05)
    bar <- function() pause(0.05)

    prof <- profvis(root())$x$message$prof
  }
})
