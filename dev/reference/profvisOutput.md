# Widget output and renders functions for use in Shiny

Widget output and renders functions for use in Shiny

## Usage

``` r
profvisOutput(outputId, width = "100%", height = "600px")

renderProfvis(expr, env = parent.frame(), quoted = FALSE)
```

## Arguments

- outputId:

  Output variable for profile visualization.

- width:

  Width of the htmlwidget.

- height:

  Height of the htmlwidget

- expr:

  An expression that returns a profvis object.

- env:

  The environment in which to evaluate `expr`.

- quoted:

  Is `expr` a quoted expression (with
  [`quote()`](https://rdrr.io/r/base/substitute.html))?
