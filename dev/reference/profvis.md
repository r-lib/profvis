# Profile an R expression and visualize profiling data

This function will run an R expression with profiling, and then return
an htmlwidget for interactively exploring the profiling data.

## Usage

``` r
profvis(
  expr = NULL,
  interval = 0.01,
  prof_output = NULL,
  prof_input = NULL,
  timing = NULL,
  width = NULL,
  height = NULL,
  split = c("h", "v"),
  torture = 0,
  simplify = TRUE,
  rerun = FALSE
)
```

## Arguments

- expr:

  Expression to profile. The expression will be turned into the body of
  a zero-argument anonymous function which is then called repeatedly as
  needed. This means that if you create variables inside of `expr` they
  will not be available outside of it.

  The expression is repeatedly evaluated until
  [`Rprof()`](https://rdrr.io/r/utils/Rprof.html) produces an output. It
  can *be* a quosure injected with
  [`rlang::inject()`](https://rlang.r-lib.org/reference/inject.html) but
  it cannot *contain* injected quosures.

  Not compatible with `prof_input`.

- interval:

  Interval for profiling samples, in seconds. Values less than 0.005 (5
  ms) will probably not result in accurate timings

- prof_output:

  Name of an Rprof output file or directory in which to save profiling
  data. If `NULL` (the default), a temporary file will be used and
  automatically removed when the function exits. For a directory, a
  random filename is used.

- prof_input:

  The path to an [`Rprof()`](https://rdrr.io/r/utils/Rprof.html) data
  file. Not compatible with `expr` or `prof_output`.

- timing:

  The type of timing to use. Either `"elapsed"` (the default) for wall
  clock time, or `"cpu"` for CPU time. Wall clock time includes time
  spent waiting for other processes (e.g. waiting for a web page to
  download) so is generally more useful.

  If `NULL`, the default, will use elapsed time where possible, i.e. on
  Windows or on R 4.4.0 or greater.

- width:

  Width of the htmlwidget.

- height:

  Height of the htmlwidget

- split:

  Orientation of the split bar: either `"h"` (the default) for
  horizontal or `"v"` for vertical.

- torture:

  Triggers garbage collection after every `torture` memory allocation
  call.

  Note that memory allocation is only approximate due to the nature of
  the sampling profiler and garbage collection: when garbage collection
  triggers, memory allocations will be attributed to different lines of
  code. Using `torture = steps` helps prevent this, by making R trigger
  garbage collection after every `torture` memory allocation step.

- simplify:

  Whether to simplify the profiles by removing intervening frames caused
  by lazy evaluation. Equivalent to the `filter.callframes` argument to
  [`Rprof()`](https://rdrr.io/r/utils/Rprof.html).

- rerun:

  If `TRUE`, [`Rprof()`](https://rdrr.io/r/utils/Rprof.html) is run
  again with `expr` until a profile is actually produced. This is useful
  for the cases where `expr` returns too quickly, before R had time to
  sample a profile. Can also be a string containing a regexp to match
  profiles. In this case, `profvis()` reruns `expr` until the regexp
  matches the modal value of the profile stacks.

## Details

An alternate way to use `profvis` is to separately capture the profiling
data to a file using [`Rprof()`](https://rdrr.io/r/utils/Rprof.html),
and then pass the path to the corresponding data file as the
`prof_input` argument to `profvis()`.

## See also

[`print.profvis()`](https://profvis.r-lib.org/dev/reference/print.profvis.md)
for printing options.

[`Rprof()`](https://rdrr.io/r/utils/Rprof.html) for more information
about how the profiling data is collected.

## Examples

``` r
# Only run these examples in interactive R sessions
if (interactive()) {

# Profile some code
profvis({
  dat <- data.frame(
    x = rnorm(5e4),
    y = rnorm(5e4)
  )

  plot(x ~ y, data = dat)
  m <- lm(x ~ y, data = dat)
  abline(m, col = "red")
})


# Save a profile to an HTML file
p <- profvis({
  dat <- data.frame(
    x = rnorm(5e4),
    y = rnorm(5e4)
  )

  plot(x ~ y, data = dat)
  m <- lm(x ~ y, data = dat)
  abline(m, col = "red")
})
htmlwidgets::saveWidget(p, "profile.html")

# Can open in browser from R
browseURL("profile.html")

}
```
