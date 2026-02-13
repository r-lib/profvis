# Parse Rprof output file for use with profvis

Parse Rprof output file for use with profvis

## Usage

``` r
parse_rprof(path = "Rprof.out", expr_source = NULL)
```

## Arguments

- path:

  Path to the [`Rprof()`](https://rdrr.io/r/utils/Rprof.html) output
  file.

- expr_source:

  If any source refs in the profiling output have an empty filename,
  that means they refer to code executed at the R console. This code can
  be captured and passed (as a string) as the `expr_source` argument.
