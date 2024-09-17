# tidyft

<details>

* Version: 0.5.7
* GitHub: https://github.com/hope-data-science/tidyft
* Source code: https://github.com/cran/tidyft
* Date/Publication: 2023-01-08 14:40:01 UTC
* Number of recursive dependencies: 47

Run `revdepcheck::cloud_details(, "tidyft")` for more info

</details>

## Newly broken

*   checking running R code from vignettes ... ERROR
    ```
    Errors in running code in vignettes:
    when running code in ‘Introduction.Rmd’
      ...
    
    > profvis({
    +     res1 = ft %>% select_fst(Species, Sepal.Length, Sepal.Width, 
    +         Petal.Length) %>% dplyr::select(-Petal.Length) %>% dplyr::re .... [TRUNCATED] 
    
    > setequal(res1, res2)
    
      When sourcing ‘Introduction.R’:
    Error: object 'res1' not found
    Execution halted
    
      ‘Introduction.Rmd’ using ‘UTF-8’... failed
    ```

*   checking re-building of vignette outputs ... NOTE
    ```
    Error(s) in re-building vignettes:
      ...
    --- re-building ‘Introduction.Rmd’ using rmarkdown
    
    Quitting from lines 113-183 [unnamed-chunk-5] (Introduction.Rmd)
    Error: processing vignette 'Introduction.Rmd' failed with diagnostics:
    object 'res1' not found
    --- failed re-building ‘Introduction.Rmd’
    
    SUMMARY: processing the following file failed:
      ‘Introduction.Rmd’
    
    Error: Vignette re-building failed.
    Execution halted
    ```

## In both

*   checking Rd cross-references ... NOTE
    ```
    Packages unavailable to check Rd xrefs: ‘tidyfst’, ‘tidyr’, ‘fastDummies’
    ```

